from auth import init_manager_for_invite
import sys

def main():
    m = init_manager_for_invite()
    res = m.send_invite(sys.argv[1],
                        email_template='templates/emailinvite.html',
                        host='http://beta.webrecorder.io')
    if res:
        print('Success')
    else:
        print('Fail')

if __name__ == "__main__":
    main()


