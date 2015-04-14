from app import init

# ============================================================================
application = init()

if __name__ == "__main__":
    run(app=application, port=8088)
