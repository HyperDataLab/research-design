import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './ui.module.css';

export interface WizardStep {
  id: string;
  title: string;
  /** What was chosen here, shown on the step once it is passed. */
  summary?: string;
  content: ReactNode;
  /** False keeps the user on this step until it is complete. */
  ready?: boolean;
}

/** A guided sequence. Only the last step carries the primary action. */
export function Wizard({
  label,
  steps,
  finishLabel,
  onFinish,
  finishDisabled = false,
  note,
  onCancel,
  initialStep = 0,
  finishVariant = 'primary',
}: {
  label: string;
  steps: WizardStep[];
  finishLabel: string;
  onFinish: () => void;
  finishDisabled?: boolean;
  /** A short line that stays visible on every step, such as the cost estimate. */
  note?: ReactNode;
  onCancel?: () => void;
  /** Opens on a later step, for work that is already filled in. */
  initialStep?: number;
  /** Secondary when another action on the page is now the main one. */
  finishVariant?: 'primary' | 'secondary';
}) {
  const [index, setIndex] = useState(initialStep);
  const current = steps[Math.min(index, steps.length - 1)];
  if (!current) return null;
  const last = index >= steps.length - 1;
  return (
    <div className={styles.wizard}>
      <ol className={styles.wizardSteps} aria-label={label}>
        {steps.map((step, position) => {
          const state = position < index ? 'done' : position === index ? 'current' : 'todo';
          return (
            <li key={step.id} className={styles.wizardStep} data-state={state}>
              <button
                type="button"
                className={styles.wizardStepButton}
                disabled={position > index}
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={() => setIndex(position)}
              >
                <span className={styles.wizardNumber} aria-hidden="true">
                  {state === 'done' ? '✓' : position + 1}
                </span>
                <span className={styles.wizardText}>
                  <span>{step.title}</span>
                  {state === 'done' && step.summary && <small>{step.summary}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className={styles.wizardBody}>{current.content}</div>
      <div className={styles.wizardFooter}>
        <div className={styles.wizardNote}>{note}</div>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Huỷ
          </Button>
        )}
        {index > 0 && <Button onClick={() => setIndex(index - 1)}>Quay lại</Button>}
        {last ? (
          <Button variant={finishVariant} disabled={finishDisabled} onClick={onFinish}>
            {finishLabel}
          </Button>
        ) : (
          <Button variant="primary" disabled={current.ready === false} onClick={() => setIndex(index + 1)}>
            Tiếp tục
          </Button>
        )}
      </div>
    </div>
  );
}
