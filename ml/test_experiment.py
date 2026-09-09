import copy
import json
from pathlib import Path
import tempfile
import unittest

from experiment import ROOT, features, metrics, predict, read_dataset, run, train

class ExperimentTests(unittest.TestCase):
    def setUp(self):
        self.rows = read_dataset(ROOT / 'data/context.jsonl')
        self.training = [r for r in self.rows if r['split'] == 'train']

    def test_metrics_known_confusion(self):
        result = metrics(['required','optional','not_required'], ['required'] * 3)
        self.assertAlmostEqual(result['accuracy'], 1 / 3)
        self.assertAlmostEqual(result['macro_f1'], 1 / 6)
        self.assertEqual(result['per_class']['optional']['precision'], 0)
        self.assertEqual(result['confusion_matrix']['not_required']['required'], 1)

    def test_masks_technology_to_avoid_label_shortcut(self):
        self.assertEqual(features('Нужен React.', 6, 11), features('Нужен Python.', 6, 12))
        self.assertNotIn('react', features('Нужен React.', 6, 11))
        with self.assertRaises(ValueError):
            features('text', 4, 8)

    def test_training_rejects_test_rows_and_fits_only_train_vocabulary(self):
        with self.assertRaises(ValueError):
            train(self.rows)
        changed = copy.deepcopy(self.rows)
        for row in changed:
            if row['split'] == 'test':
                row['text'] += ' hiddenonlytoken'
        model = train([r for r in changed if r['split'] == 'train'])
        self.assertNotIn('hiddenonlytoken', model['vocabulary'])
        self.assertEqual(model, train(self.training))

    def test_learns_patterns_and_roundtrips_json(self):
        model = json.loads(json.dumps(train(self.training)))
        for row in self.training:
            self.assertEqual(predict(model, row['text'], row['start'], row['end']), row['label'])

    def test_duplicate_and_cross_split_group_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'bad.jsonl'
            duplicate = self.rows + [self.rows[0]]
            path.write_text('\n'.join(json.dumps(r) for r in duplicate), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate ID'):
                read_dataset(path)
            changed = copy.deepcopy(self.rows)
            changed[-1]['group_id'] = changed[0]['group_id']
            path.write_text('\n'.join(json.dumps(r) for r in changed), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'crosses train/test'):
                read_dataset(path)

    def test_artifacts_are_reproducible(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / 'a', Path(directory) / 'b'
            run(ROOT / 'data/context.jsonl', first)
            run(ROOT / 'data/context.jsonl', second)
            for filename in ('model.json','report.json','REPORT.md'):
                self.assertEqual((first / filename).read_bytes(), (second / filename).read_bytes())
                self.assertEqual((first / filename).read_bytes(), (ROOT / 'artifacts' / filename).read_bytes())

if __name__ == '__main__':
    unittest.main()
