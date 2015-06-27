from app import init
from bottle import run


# ============================================================================
application = init()

if __name__ == "__main__":
    run(app=application, port=8088)
