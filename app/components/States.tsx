export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="game-grid" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, index) => <div key={index} className="game-card skeleton" />)}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box" role="alert">
      <p className="state-title">Не получилось загрузить</p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="secondary-button small" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="state-box">
      <p className="state-title">{title}</p>
      {children}
    </div>
  );
}
