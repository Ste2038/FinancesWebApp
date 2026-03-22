type BarGroup = {
  month: string;
  currentYear: number;
  previousYear: number;
};

export function GroupedBars({ groups }: { groups: BarGroup[] }) {
  const max = Math.max(...groups.flatMap((group) => [group.currentYear, group.previousYear]), 1);

  return (
    <div className="bar-chart">
      {groups.map((group) => {
        const currentHeight = `${(group.currentYear / max) * 100}%`;
        const previousHeight = `${(group.previousYear / max) * 100}%`;

        return (
          <div className="bar-chart__group" key={group.month}>
            <div className="bar-chart__bars">
              <span className="bar-chart__bar bar-chart__bar--previous" style={{ height: previousHeight }} />
              <span className="bar-chart__bar bar-chart__bar--current" style={{ height: currentHeight }} />
            </div>
            <span className="bar-chart__label">{group.month}</span>
          </div>
        );
      })}
    </div>
  );
}
