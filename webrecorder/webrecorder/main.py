# third party imports
from bottle import run
from gevent import monkey


monkey.patch_all()


# library specific imports
from webrecorder.appcontroller import AppController


APPLICATION = AppController().app

if __name__ == "__main__":
    run(app=APPLICATION, port=8088)
