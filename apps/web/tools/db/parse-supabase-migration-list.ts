export type SupabaseMigrationListRow = {
  localVersion: string | null;
  remoteVersion: string | null;
  timeUtc: string;
};

export function parseSupabaseMigrationList(
  output: string
): SupabaseMigrationListRow[] {
  try {
    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      lines.length < 3 ||
      lines[0]?.replace(/\s+/g, ' ') !== 'Local | Remote | Time (UTC)' ||
      !/^-{3,}\|-{3,}\|-{3,}$/.test(lines[1]?.replace(/\s+/g, '') ?? '')
    ) {
      throw new Error();
    }
    const rows = lines.slice(2).map((line) => {
      const columns = line.split('|').map((column) => column.trim());
      if (columns.length !== 3) throw new Error();
      const [local = '', remote = '', timeUtc = ''] = columns;
      const version = /^\d{14}$/;
      const validTime =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeUtc) ||
        (version.test(timeUtc) && (timeUtc === local || timeUtc === remote));
      if (
        (!local && !remote) ||
        (local && !version.test(local)) ||
        (remote && !version.test(remote)) ||
        !validTime
      ) {
        throw new Error();
      }
      return {
        localVersion: local || null,
        remoteVersion: remote || null,
        timeUtc,
      };
    });
    if (rows.length === 0) throw new Error();
    return rows;
  } catch {
    throw new Error('Invalid Supabase migration list output');
  }
}
