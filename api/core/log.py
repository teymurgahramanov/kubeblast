import logging
from config import config

logging.basicConfig(level=config.LOG_LEVEL,
                    datefmt='%Y-%m-%d %H:%M:%S',
                    format="%(asctime)s - API - %(levelname)s - %(message)s")

logger = logging.getLogger(__name__)


