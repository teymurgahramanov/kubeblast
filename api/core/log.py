import logging
from config import config

logging.basicConfig(level=config.LOG_LEVEL,
                    datefmt='%Y-%m-%d %H:%M:%S',
                    format="%(asctime)s - %(levelname)s - %(message)s")

logger = logging.getLogger()