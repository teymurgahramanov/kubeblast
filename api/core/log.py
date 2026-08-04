import logging
import sys

from config import config

logging.basicConfig(
    level=config.LOG_LEVEL,
    datefmt="%Y-%m-%d %H:%M:%S",
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
    force=True,
)

logger = logging.getLogger()