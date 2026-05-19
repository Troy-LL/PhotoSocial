import styles from "./PlaceholderTile.module.css";

export function PlaceholderTile({
  name,
  index,
}: {
  name?: string | null;
  index: number;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={styles.placeholder}
      aria-label={name ? `Waiting for ${name}` : `Empty slot ${index + 1}`}
    >
      <span className={styles.avatar} aria-hidden="true">
        {initial}
      </span>
      {name && <span className={styles.name}>{name}</span>}
    </div>
  );
}
