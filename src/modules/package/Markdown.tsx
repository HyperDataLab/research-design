import styles from './Page.module.css';

const clean = (s: string) =>
  s.replace(/\\\|/g, '|').replace(/\\\\/g, '\\').replaceAll('<br>', '\n').replaceAll('`', '');
const cells = (s: string) =>
  s
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((x) => clean(x.trim()));
export function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.reading}>
      {text
        .trim()
        .split(/\n\n+/)
        .map((block, i) => {
          const lines = block.split('\n');
          if (block.startsWith('## ')) return <h2 key={i}>{clean(block.slice(3))}</h2>;
          if (block.startsWith('# ')) return <h1 key={i}>{clean(block.slice(2))}</h1>;
          if (block.startsWith('|')) {
            const header = cells(lines[0] ?? '');
            return (
              <div className={styles.tableWrap} key={i}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {header.map((c, j) => (
                        <th scope="col" key={j}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.slice(2).map((line, j) => (
                      <tr key={j}>
                        {cells(line).map((c, k) => (
                          <td key={k}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (lines.every((line) => line.startsWith('- ')))
            return (
              <ul key={i}>
                {lines.map((line, j) => (
                  <li key={j}>{clean(line.slice(2))}</li>
                ))}
              </ul>
            );
          return (
            <p key={i}>
              {lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {clean(line.trim())}
                </span>
              ))}
            </p>
          );
        })}
    </div>
  );
}
