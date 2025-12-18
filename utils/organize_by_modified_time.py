from argparse import ArgumentParser, BooleanOptionalAction
from pathlib import Path
from datetime import datetime

parser = ArgumentParser()
parser.add_argument('dir', type=str)
parser.add_argument('--dry-run', action=BooleanOptionalAction)
args = parser.parse_args()

input_dir = Path(args.dir)

for path in input_dir.glob('*'):
    if path.is_dir():
        continue
    stat = path.stat()
    modified_at = datetime.fromtimestamp(stat.st_mtime)
    output_dir = input_dir / f'{modified_at.year:04}-{modified_at.month:02}'

    if not args.dry_run:
        output_dir.mkdir(exist_ok=True)
        path.rename(output_dir / path.name)

    print(f'{str(path)} -> {str(output_dir / path.name)}')
