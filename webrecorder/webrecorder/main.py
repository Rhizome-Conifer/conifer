from gevent import monkey; monkey.patch_all()

#from app import init
from webrecorder.appcontroller import AppController
from bottle import run


# ============================================================================
application = AppController().app

if __name__ == "__main__":
    run(app=application, port=8088)
