import pytest
import pytest_asyncio
from app.database import init_db

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    await init_db()
    yield
