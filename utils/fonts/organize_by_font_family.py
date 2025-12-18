import os
import logging
from dataclasses import dataclass
from argparse import ArgumentParser
from pathlib import Path

from fontTools.ttLib import TTFont

@dataclass
class Argument:
    log_level: str
    in_rm: bool
    in_dir: Path
    out_dir: Path

parser = ArgumentParser(description='폰트 파일을 패밀리 이름 기반으로 정리하고 이름을 변경하는 스크립트')
parser.add_argument('-l', '--log-level', type=str, default='INFO', choices=logging._nameToLevel.keys(), help='로그 출력 레벨 설정')
parser.add_argument('--in-rm', action='store_true', help='작업 완료 후 원본 파일 삭제')
parser.add_argument('-i', '--in-dir', type=Path, required=True, help='입력 디렉터리 경로')
parser.add_argument('-o', '--out-dir', type=Path, help='출력 디렉터리 경로 (미지정 시 입력 디렉터리와 동일)')
args = Argument(**vars(parser.parse_args()))

logging.basicConfig(
    level=logging._nameToLevel.get(args.log_level, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger(__name__)

try:
    # 입력 디렉터리 확인
    if not args.in_dir.is_dir():
        raise ValueError('유효하지 않은 입력 디렉터리 경로입니다.')

    # 출력 디렉터리 설정
    if not args.out_dir:
        log.info('출력 디렉터리가 지정되지 않았습니다. 입력 디렉터리를 그대로 사용합니다.')
        args.out_dir = args.in_dir

    # 출력 디렉터리 생성 확인
    if not args.out_dir.is_dir():
        if args.out_dir.exists():
            raise ValueError('출력 경로가 존재하지만 디렉터리가 아닙니다.')
        args.out_dir.mkdir(parents=True)

    fonts: dict[str, tuple[Path, Path]] = {}

    # 폰트 파일 탐색 및 정보 추출
    for path in (
        p.resolve()
        for p in args.in_dir.glob('**/*')
        if p.suffix.lower() in {'.ttf', '.ttc', '.otf'}
    ):
        font = TTFont(path, fontNumber=0)

        font_family: str = ''

        # 폰트 메타데이터(name table)에서 Family Name 추출
        for record in font['name'].names:
            if record.nameID != 1:        # Font Family Name
                continue
            if record.platformID != 3:    # Windows Platform
                continue
            if record.langID != 0x409:    # US English (가장 호환성 높음)
                continue
            font_family = record.toUnicode()
            break

        # 패밀리 이름을 찾지 못한 경우 (원본 코드는 여기서 전체 종료되었으나, 해당 파일만 건너뛰도록 수정)
        if not font_family:
            log.warning(f'폰트 패밀리 정보를 찾을 수 없어 건너뜁니다: {path}')
            continue

        # 이미 같은 패밀리 이름의 폰트가 처리 목록에 있는 경우
        if font_family in fonts:
            log.warning(f'중복된 폰트 패밀리가 감지되어 건너뜁니다: {path} (Family: {font_family})')
            continue

        # 파일 확장자 결정 (OTTO 타입이면 otf, 그 외는 ttf)
        font_extension = font.flavor or (
            'otf'
            if font.sfntVersion == 'OTTO' else
            'ttf'
        )

        dst_path: Path = (args.out_dir / f'{font_family}.{font_extension}').resolve()

        # 대상 경로에 이미 파일이 존재하는 경우
        if dst_path.exists():
            log.warning(f'대상 경로에 파일이 이미 존재하여 건너뜁니다: {path} -> {dst_path}')
            continue

        fonts[font_family] = (path, dst_path)

    # 실제 파일 링크(하드링크) 및 정리 작업 수행
    count = 0
    for (src_path, dst_path) in fonts.values():
        # 원본과 대상이 동일한 경우 처리 생략
        if src_path == dst_path:
            continue

        # 하드 링크 생성 (주의: 다른 파티션/드라이브 간에는 작동하지 않음)
        os.link(src_path, dst_path)
        count += 1

        if args.in_rm:
            log.info(f'원본 파일 삭제: {src_path}')
            src_path.unlink()

    log.info(f'작업 완료: 총 {count}개의 폰트가 처리되었습니다.')

except Exception:
    log.exception('폰트 정리 작업 중 예기치 않은 오류가 발생했습니다.')
    exit(1)
