"""Train and evaluate an interpretable context classifier using only Python stdlib.

This experiment classifies ONE marked skill mention in a short excerpt.
It does not detect entities or measure the quality of the site's extractor.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
LABELS = ('required', 'optional', 'not_required')
VERSION = 'context-nb-v1'


def features(text: str, start: int, end: int) -> list[str]:
    if not (0 <= start < end <= len(text)):
        raise ValueError('Invalid mention offsets')
    masked = text[:start] + ' targetskill ' + text[end:]
    tokens = re.findall(r'[a-zа-яё0-9]+', masked.lower())
    return tokens + [a + '|' + b for a, b in zip(tokens, tokens[1:])]


def read_dataset(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not rows:
        raise ValueError('Empty dataset')
    ids, normalized, group_splits = set(), set(), {}
    for row in rows:
        if row['id'] in ids:
            raise ValueError('Duplicate ID: ' + row['id'])
        ids.add(row['id'])
        if row['label'] not in LABELS or row['split'] not in ('train', 'test'):
            raise ValueError('Unknown label or split')
        if row['source'] != 'synthetic-authored':
            raise ValueError('This experiment is restricted to the documented synthetic dataset')
        start, end = row['start'], row['end']
        if row['text'][start:end] != row['skill']:
            raise ValueError('Mention offsets do not match skill')
        fs = features(row['text'], start, end)
        normalized_text = ' '.join(fs)
        if normalized_text in normalized:
            raise ValueError('Duplicate masked example')
        normalized.add(normalized_text)
        group = row['group_id']
        if group in group_splits and group_splits[group] != row['split']:
            raise ValueError('Template group crosses train/test boundary')
        group_splits[group] = row['split']
    for split in ('train', 'test'):
        if {row['label'] for row in rows if row['split'] == split} != set(LABELS):
            raise ValueError('Every split must contain every label')
    return rows


def train(rows: list[dict], alpha: float = 1.0) -> dict:
    if not rows or any(row['split'] != 'train' for row in rows):
        raise ValueError('Training accepts only train rows')
    if alpha <= 0:
        raise ValueError('alpha must be positive')
    docs = Counter(row['label'] for row in rows)
    if set(docs) != set(LABELS):
        raise ValueError('Training requires all classes')
    counts = {label: Counter() for label in LABELS}
    vocabulary = set()
    for row in rows:
        fs = features(row['text'], row['start'], row['end'])
        counts[row['label']].update(fs)
        vocabulary.update(fs)
    vocab = sorted(vocabulary)
    return {
        'version': VERSION,
        'algorithm': 'multinomial-naive-bayes',
        'dataset_kind': 'synthetic-authored',
        'alpha': alpha,
        'classes': list(LABELS),
        'vocabulary': vocab,
        'log_prior': {label: math.log(docs[label] / len(rows)) for label in LABELS},
        'log_likelihood': {
            label: {token: math.log((counts[label][token] + alpha) /
                                   (sum(counts[label].values()) + alpha * len(vocab)))
                    for token in vocab}
            for label in LABELS
        },
    }


def predict(model: dict, text: str, start: int, end: int) -> str:
    fs = Counter(features(text, start, end))
    scores = {label: model['log_prior'][label] + sum(
        count * model['log_likelihood'][label][token]
        for token, count in fs.items() if token in model['log_likelihood'][label]
    ) for label in model['classes']}
    # Scores rank classes only. They are not calibrated confidence estimates.
    return max(model['classes'], key=lambda label: scores[label])


def metrics(expected: list[str], actual: list[str]) -> dict:
    if not expected or len(expected) != len(actual):
        raise ValueError('Expected equal nonempty vectors')
    if any(label not in LABELS for label in expected + actual):
        raise ValueError('Unknown metric label')
    matrix = {label: {other: 0 for other in LABELS} for label in LABELS}
    for truth, prediction in zip(expected, actual):
        matrix[truth][prediction] += 1
    per_class = {}
    for label in LABELS:
        tp = matrix[label][label]
        support = sum(matrix[label].values())
        predicted = sum(matrix[other][label] for other in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {'precision': precision, 'recall': recall, 'f1': f1, 'support': support}
    return {'accuracy': sum(t == p for t, p in zip(expected, actual)) / len(expected),
            'macro_f1': sum(row['f1'] for row in per_class.values()) / len(LABELS),
            'per_class': per_class, 'confusion_matrix': matrix}


def run(data_path: Path, output: Path) -> dict:
    rows = read_dataset(data_path)
    training = [r for r in rows if r['split'] == 'train']
    testing = [r for r in rows if r['split'] == 'test']
    model = train(training)
    digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
    model['dataset_sha256'] = digest
    truth = [r['label'] for r in testing]
    predictions = [predict(model, r['text'], r['start'], r['end']) for r in testing]
    report = {
        'version': VERSION, 'dataset_sha256': digest,
        'scope': 'Synthetic context classification only; not real-vacancy or entity-extraction quality.',
        'train_count': len(training), 'test_count': len(testing),
        'baseline_name': 'Every mention is required (no context analysis)',
        'baseline': metrics(truth, ['required'] * len(testing)),
        'model': metrics(truth, predictions),
        'predictions': [{'id': r['id'], 'text': r['text'], 'skill': r['skill'],
                         'expected': r['label'], 'predicted': p} for r, p in zip(testing, predictions)],
    }
    output.mkdir(parents=True, exist_ok=True)
    for filename, value in [('model.json', model), ('report.json', report)]:
        (output / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    errors = [r for r in report['predictions'] if r['expected'] != r['predicted']]
    lines = ['# JobLens: учебный ML-эксперимент', '',
             'Данные искусственно составлены для разработки. Это не оценка на реальных вакансиях.', '',
             f'Обучение: {len(training)} примеров. Проверка: {len(testing)} примеров. Версия: `{VERSION}`.', '',
             '| Метод | Accuracy | Macro F1 |', '|---|---:|---:|']
    for name, key in [('Все упоминания обязательны', 'baseline'), ('Naive Bayes: слова и пары слов', 'model')]:
        result = report[key]
        lines.append(f"| {name} | {result['accuracy']:.3f} | {result['macro_f1']:.3f} |")
    lines += ['', '## Ошибки', '']
    lines += [f"- {r['id']}: «{r['text']}» — ожидалось `{r['expected']}`, получено `{r['predicted']}`." for r in errors] or ['Ошибок в этой небольшой проверочной выборке нет. Обобщение на новые данные не доказано.']
    lines += ['', '## Ограничения', '',
              'Один автор и сходный стиль обучающих и проверочных примеров могут завышать результат. '
              'Классифицируется один отмеченный навык в коротком контексте. Нет нейтрального класса, '
              'контекста нескольких противоречивых упоминаний, OCR или исправления опечаток. '
              'Оценки не калиброваны. До подключения к продукту нужна независимая разметка реальных данных.', '',
              'Проверочная выборка не используется для словаря признаков или обучения. '
              'Повторная настройка по её ошибкам потребует новой закрытой выборки.', '',
              f'SHA-256 набора данных: `{digest}`.', '']
    (output / 'REPORT.md').write_text('\n'.join(lines), encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    build = sub.add_parser('train')
    build.add_argument('--data', type=Path, default=ROOT / 'data/context.jsonl')
    build.add_argument('--output', type=Path, default=ROOT / 'artifacts')
    infer = sub.add_parser('predict')
    infer.add_argument('--text', required=True)
    infer.add_argument('--skill', required=True)
    infer.add_argument('--model', type=Path, default=ROOT / 'artifacts/model.json')
    args = parser.parse_args()
    if args.command == 'train':
        report = run(args.data, args.output)
        print(json.dumps({key: report[key] for key in ('train_count', 'test_count')}, ensure_ascii=False))
        print(f"Synthetic test macro F1: baseline={report['baseline']['macro_f1']:.3f}, model={report['model']['macro_f1']:.3f}")
    else:
        if not args.skill or args.text.count(args.skill) != 1 or len(args.text) > 500:
            parser.error('Use a short excerpt (up to 500 characters) with exactly one occurrence of --skill')
        model = json.loads(args.model.read_text(encoding='utf-8'))
        if model.get('version') != VERSION:
            parser.error('Unsupported model version')
        start = args.text.index(args.skill)
        print(json.dumps({'label': predict(model, args.text, start, start + len(args.skill)),
                          'version': VERSION, 'experimental': True}, ensure_ascii=False))

if __name__ == '__main__':
    main()
