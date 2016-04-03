#!/usr/bin/env python
# vim: set sw=4 et:

from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand
import glob

from wrrecorder import __version__


# Fix for TypeError: 'NoneType' object is not callable" error
# when running 'python setup.py test'
try:
    import multiprocessing
except ImportError:
    pass


#long_description = open('README.rst').read()
long_description = ''


class PyTest(TestCommand):
    def finalize_options(self):
        TestCommand.finalize_options(self)
        # should work with setuptools <18, 18 18.5
        self.test_suite = ' '

    def run_tests(self):
        import pytest
        import sys
        import os
        cmdline = ' --cov-config .coveragerc --cov ./wrrecorder/ -vv ./test/'
        errcode = pytest.main(cmdline)
        sys.exit(errcode)


setup(
    name='wrrecorder',
    version=__version__,
    url='https://webrecorder.io',
    author='Ilya Kreymer',
    author_email='support@webrecorder.io',
    description='Webrecorder Archiving Platform',
    long_description=long_description,
    packages=find_packages(),
    zip_safe=True,
    provides=[
        'wrrecorder',
    ],
    install_requires=[
        #'bottle',
        #'bottle-cork',
        #'pywb',
        #'hiredis',
        #'uwsgi',
       ],
    tests_require=[
        'pytest',
        'WebTest',
        'pytest-cov',
       ],
    cmdclass={'test': PyTest},
    test_suite='',
)
