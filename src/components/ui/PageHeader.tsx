import type { ReactNode } from 'react';
import { Icon } from '@/components/shell/icons';

/** A consistent, compact introduction for student pages. */
export function PageHeader({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        <span className="page-heading-icon" aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
        <div className="min-w-0">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children && <div className="page-heading-action">{children}</div>}
    </header>
  );
}
