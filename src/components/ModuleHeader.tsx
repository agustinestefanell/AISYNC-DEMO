import type { ReactNode } from 'react';

interface ModuleHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  localNavigation?: ReactNode;
  primaryActions?: ReactNode;
  secondaryControls?: ReactNode;
  metrics?: ReactNode;
  tone?: 'neutral' | 'workspace' | 'audit' | 'map' | 'cross';
  className?: string;
}

export function ModuleHeader({
  eyebrow,
  title,
  subtitle,
  localNavigation,
  primaryActions,
  secondaryControls,
  metrics,
  tone = 'neutral',
  className,
}: ModuleHeaderProps) {
  return (
    <section className={`ui-module-header ui-module-header-tone-${tone} ${className ?? ''}`}>
      <div className="ui-module-header-main">
        <div className="ui-module-header-copy">
          {eyebrow ? <div className="ui-module-header-eyebrow">{eyebrow}</div> : null}
          <h2 className="ui-module-header-title">{title}</h2>
          {subtitle ? <p className="ui-module-header-subtitle">{subtitle}</p> : null}
        </div>

        {primaryActions ? <div className="ui-module-header-actions">{primaryActions}</div> : null}
      </div>

      {localNavigation ? (
        <div className="ui-module-header-nav">
          {localNavigation}
        </div>
      ) : null}

      {secondaryControls || metrics ? (
        <div className="ui-module-header-secondary">
          {secondaryControls ? <div className="ui-module-header-controls">{secondaryControls}</div> : null}
          {metrics ? <div className="ui-module-header-metrics">{metrics}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
