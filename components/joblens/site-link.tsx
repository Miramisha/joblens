import type { ComponentProps } from 'react';
// Full-page navigation avoids the deployed Vinext RSC prefetch failure.
// It also refreshes server-side authentication state after account operations.
export default function SiteLink({ children, ...props }: ComponentProps<'a'>) {
  return <a {...props}>{children}</a>;
}
