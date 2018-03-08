from gevent import monkey; monkey.patch_all()

#from app import init
from webrecorder.maincontroller import MainController
from bottle import run


# ============================================================================
application = MainController().app

if __name__ == "__main__":
    run(app=application, port=8088)
