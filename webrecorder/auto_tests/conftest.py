import pytest


# ============================================================================
def pytest_addoption(parser):
    parser.addoption('--append', default='', action='store')
    parser.addoption('--auto', default='', action='store')
    parser.addoption('--delete', default=False, action='store_true')


# ============================================================================
def pytest_collection_modifyitems(config, items):
    append = config.getoption('--append')
    delete = config.getoption('--delete')

    skip_marker = pytest.mark.skip(reason='skipping others')

    for item in items:
        include = True

        if delete:
            include = ('delete' in item.keywords)

        elif append:
            include = ('append' in item.keywords)

        else:
            include = ('delete' not in item.keywords) and ('append' not in item.keywords)

        if 'always' in item.keywords:
            include = True

        if not include:
            item.add_marker(skip_marker)


@pytest.fixture
def append(request):
    return request.config.getoption('--append')


@pytest.fixture
def auto_id(request):
    return request.config.getoption('--auto')


