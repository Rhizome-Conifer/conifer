from bottle import request
from datetime import timedelta


class Session(object):
    def __init__(self, cork, anon_duration):
        self.anon_duration = anon_duration
        self.sesh = request.environ.get('beaker.session')
        self.curr_user = None
        self.curr_role = None

        try:
            if self.sesh.get('anon'):
                self.curr_role = 'anon'
            else:
                self.curr_user = self.sesh.get('username')
                if self.curr_user:
                    self.curr_role = cork.user(self.curr_user).role

        except Exception as e:
            print(e)
            self.curr_user = None
            self.curr_role = None
            if self.sesh:
                self.sesh.delete()

        message, msg_type = self.pop_message()

        params = {'curr_user': self.curr_user,
                  'curr_role': self.curr_role,
                  'message': message,
                  'msg_type': msg_type}

        request.environ['pywb.template_params'] = params

    def set_anon(self):
        if not self.curr_user:
            self.sesh['anon'] = True

            # force expires to be updated
            self.sesh.cookie_expires = timedelta(seconds=self.anon_duration)
            self.sesh['_expires'] = self.sesh._set_cookie_expires(None)
            self.sesh.save()
            self.sesh._update_cookie_out()


    @property
    def anon_user(self):
        return make_anon_user(self.sesh.id)

    def flash_message(self, msg, msg_type='danger'):
        if self.sesh:
            self.sesh['message'] = msg_type + ':' + msg
            self.sesh.save()
        else:
            print('No Message')

    def pop_message(self):
        msg_type = ''
        if not self.sesh:
            return '', msg_type

        message = self.sesh.get('message', '')
        if message:
            self.sesh['message'] = ''
            self.sesh.save()

        if ':' in message:
            msg_type, message = message.split(':', 1)

        return message, msg_type


def make_anon_user(id):
    return '@anon-' + id


def flash_message(*args, **kwargs):
    return request['webrec.session'].flash_message(*args, **kwargs)
