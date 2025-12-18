import re
from argparse import ArgumentParser, BooleanOptionalAction
from pathlib import Path
from datetime import datetime

parser = ArgumentParser()
parser.add_argument('dir', type=str)
parser.add_argument('--dry-run', action=BooleanOptionalAction)
args = parser.parse_args()

input_dir = Path(args.dir)

for path in input_dir.rglob('*'):
    if path.is_dir():
        continue

    if re.match('^\\d{4}-\\d{2}-\\d{2}', path.name):
        continue

    stat = path.stat()
    modified_at = datetime.fromtimestamp(stat.st_mtime)
    new_path = path.with_name(f'{modified_at.strftime('%Y-%m-%d_%H-%M-%S')}_{path.name}')

    if not args.dry_run:
        path.rename(new_path)

    print(f'{str(path)} -> {str(new_path)}')
