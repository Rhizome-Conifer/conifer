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

def load_requirements(filename):
    with open(filename, 'rt') as fh:
        return fh.read().rstrip().split('\n')


class PyTest(TestCommand):
    def finalize_options(self):
        TestCommand.finalize_options(self)
        # should work with setuptools <18, 18 18.5
        self.test_suite = ' '

    def run_tests(self):
        import pytest
        import sys
        import os
        cmdline = ' --cov-config .coveragerc --cov ./webrecorder/ -vv ./test/'
        errcode = pytest.main(cmdline)
        sys.exit(errcode)


class Install(install):
    def initialize_options(self):
        from webrecorder.standalone.assetsutils import default_build
        default_build()
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
        'pywb>=0.50.0'
    ],
    install_requires=load_requirements('requirements.txt'),
    dependency_links=[
        'git+https://github.com/ikreymer/pywb.git@new-pywb#egg=pywb-0.50.0',
    ],
    tests_require=[
        'pytest',
        'WebTest',
        'pytest-cov',
        'fakeredis',
        'mock',
       ],
    cmdclass={'test': PyTest,
              'install': Install},
    test_suite='',
    entry_points="""
        [console_scripts]
        webrecorder = webrecorder.standalone.standalone:webrecorder
        webrecorder-player = webrecorder.standalone.standalone:webrecorder_player
    """
)
