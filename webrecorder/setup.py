#!/usr/bin/env python
# vim: set sw=4 et:

from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand
from setuptools.command.install import install
import os

from webrecorder import __version__


# Fix for TypeError: 'NoneType' object is not callable" error
# when running 'python setup.py test'
try:
    import multiprocessing
except ImportError:
    pass

#long_description = open('README.rst').read()
long_description = ''

PYWB_MIN_VER = '2.4.1'

PYWB_DEP = 'pywb>=' + PYWB_MIN_VER

def load_requirements(filename):
    with open(filename, 'rt') as fh:
        res = fh.read().rstrip().split('\n')
        res.append(PYWB_DEP)
        return res


def get_git_short_hash():
    import subprocess
    try:
        return subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD']).rstrip().decode('utf-8')
    except:
        return ''

def generate_git_hash_py(pkg):
    try:
        git_hash = get_git_short_hash()
        with open(os.path.join(pkg, 'git_hash.py'), 'wt') as fh:
            fh.write('git_hash = "{0}"\n'.format(git_hash))
    except:
        pass


class PyTest(TestCommand):
    def finalize_options(self):
        TestCommand.finalize_options(self)
        # should work with setuptools <18, 18 18.5
        self.test_suite = ' '

    def run_tests(self):
        import pytest
        import sys
        import os
        cmdline = '--cov-config .coveragerc --cov ./webrecorder/ -vv ./test/'
        errcode = pytest.main(cmdline.split(' '))
        sys.exit(errcode)


class Install(install):
    def initialize_options(self):
        from webrecorder.standalone.assetsutils import default_build
        from webrecorder.load.wamloader import WAMLoader
        default_build()
        WAMLoader.merge_webarchives()
        generate_git_hash_py('webrecorder')
        super(Install, self).initialize_options()



setup(
    name='webrecorder',
    version=__version__,
    url='https://webrecorder.io',
    author='rhizome.org',
    author_email='support@webrecorder.io',
    description='Webrecorder Archiving Platform',
    long_description=long_description,
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    provides=[
        'webrecorder',
        'webrecorder.rec',
        'webrecorder.load',
        'webrecorder.standalone',
    ],
    package_data={
        'webrecorder': ['config/*',
                        'static/images/*',
                        'static/bundle/*',
                        'templates/*.*',
                        'templates/recordings/*',
                        'static/external/bootstrap/fonts/*'],
    },
    setup_requires=[
        PYWB_DEP
    ],
    install_requires=load_requirements('requirements.txt'),
    dependency_links=[
        'git+https://github.com/ikreymer/pywb.git@develop#egg=pywb-' + PYWB_MIN_VER,
        'git+https://github.com/FedericoCeratto/bottle-cork.git@94d4017a4d1b0d20328e9283e341bd674df3a18a#egg=bottle-cork',
    ],
    tests_require=[
        'pytest',
        'WebTest',
        'pytest-cov',
        'fakeredis',
        'mock',
        'responses',
        'httpbin==0.5.0',
        'websocket-client'
       ],
    cmdclass={'test': PyTest,
              'install': Install},
    test_suite='',
    entry_points="""
        [console_scripts]
        webrecorder = webrecorder.standalone.webrecorder_full:webrecorder
        webrecorder-player = webrecorder.standalone.webrecorder_player:webrecorder_player
    """
)
