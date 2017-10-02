import os

# Note: must be run *outside* Docker to migrate wr.env file

def main():
    env_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', '..', 'wr.env')
    with open(env_path, 'r+') as fh:
        buff = fh.read()
        if not buff:
            print('No Env')
            return

        buff = buff.replace('WEBAGG_HOST', 'WARCSERVER_HOST')
        buff = buff.replace('http://webagg', 'http://warcserver')

        fh.seek(0)
        fh.write(buff)
        print('Updated wr.env')

main()

