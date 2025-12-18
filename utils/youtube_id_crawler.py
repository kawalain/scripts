import ssl
import secrets
import asyncio
import logging
import string
from argparse import ArgumentParser
from dataclasses import dataclass

@dataclass
class Argument:
    log_level: str
    concurrency: int
    id_chars: str
    id_length: int

parser = ArgumentParser()
parser.add_argument('-l', '--log-level', type=str, default='INFO', choices=logging._nameToLevel.keys())
parser.add_argument('-c', '--concurrency', type=int, default=20)
parser.add_argument('--id-chars', type=str, default=string.ascii_letters + string.digits + '-_', metavar='abc...')
parser.add_argument('--id-length', type=int, default=11, choices=range(1,100), metavar='[1-100]')
args = Argument(**vars(parser.parse_args()))

logging.basicConfig(level=logging._nameToLevel.get(args.log_level, logging.INFO))
log = logging.getLogger(__name__)

loop = asyncio.new_event_loop()
semaphore = asyncio.Semaphore(args.concurrency)
id_chars = tuple(args.id_chars)

checks = 0
hits = 0

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

async def task():
    global checks, hits

    checks += 1
    id = ''.join(secrets.choice(id_chars) for _ in range(args.id_length))

    w: asyncio.StreamWriter | None = None

    try:
        r, w = await asyncio.open_connection('i.ytimg.com', 443, ssl=ssl_ctx)

        headers = (
            f'HEAD /vi/{id}/default.jpg HTTP/1.1\r\n'
            'Host: i.ytimg.com\r\n'
            'Connection: close\r\n'
            '\r\n'
        )

        w.write(headers.encode())
        await w.drain()

        response = await r.readline()
        if not response:
            raise RuntimeError('Server returned empty response')

        parts = response.decode('latin-1').strip().split()
        if len(parts) < 2:
            raise RuntimeError('Server returned invalid response')

        status = int(parts[1])
        log.debug(f'{id}: {status}')

        if status == 200:
            hits += 1
            log.info(f'Hit: https://youtu.be/{id}')
    except asyncio.CancelledError:
        raise
    except Exception:
        log.debug(id, exc_info=True)
    finally:
        if w:
            try:
                w.close()
                await w.wait_closed()
            except:
                pass
        semaphore.release()

async def main():
    tasks = set()

    log.info(f"Starting crawler with concurrency {args.concurrency}...")

    try:
        while True:
            await semaphore.acquire()
            t = asyncio.create_task(task())
            t.add_done_callback(tasks.discard)
            tasks.add(t)
    except asyncio.CancelledError:
        log.info("Stopping...")
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 1000)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
