#!/usr/bin/env python
# vim: set sw=4 et:

from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand
import glob

from wfa import __version__


# Fix for TypeError: 'NoneType' object is not callable" error
# when running 'python setup.py test'
try:
    import multiprocessing
except ImportError:
    pass


long_description = open('README.rst').read()


class PyTest(TestCommand):
    def finalize_options(self):
        TestCommand.finalize_options(self)
        self.test_suite = True

    def run_tests(self):
        import pytest
        import sys
        import os
        cmdline = ' --cov wfa'
        errcode = pytest.main(cmdline)
        sys.exit(errcode)

setup(
    name='webrecorder',
    version=__version__,
    url='https://webrecorder.io',
    author='Ilya Kreymer',
    author_email='support@webrecorder.io',
    description='Webrecorder Archiving Platform',
    long_description=long_description,
    packages=find_packages(),
    zip_safe=True,
    provides=[
        'wfa',
    ],
    install_requires=[
        'bottle',
        'bottle-cork',
        'pywb'
        'hiredis',
        'uwsgi',
       ],
    tests_require=[
        'pytest',
        'WebTest',
        'pytest-cov',
       ],
    cmdclass={'test': PyTest},
    test_suite='',
])
