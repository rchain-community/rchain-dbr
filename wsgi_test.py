#!/usr/bin/python3

import logging

log = logging.getLogger(__name__)


class WSGI:
    PLAIN = [('Content-Type', 'text/plain')]
    HTML8 = [('Content-Type', 'text/html; charset=utf-8')]
    PDF = [('Content-Type', 'application/pdf')]
    
    QS = 'QUERY_STRING'
    
    @classmethod
    def param(cls, env, n):
        v = parse_qs(env.get(cls.QS, n)).get(n)
        if not v:
            raise KeyError('missing %s parameter' % n)
        return v
    
    @classmethod
    def error_middleware(cls, format_exc, app):
        '''
        TODO: factor out of print_report.py
        '''
        def err_app(env, start_response):
            try:
                return app(env, start_response)
            except:  # pylint: disable-msg=W0703,W0702
                start_response('500 internal error', WSGI.PLAIN)
                return [format_exc()]
            
        return err_app


class App(object):
    def __call__(self, environ, start_response):
        start_response('200 OK', WSGI.PLAIN)
        return [b'Hello, World!']


def build_app():
    from wsgiref.handlers import CGIHandler  # ISSUE: ambient
    from traceback import format_exc  # ISSUE: ambient
    app = App()
    wrap = WSGI.error_middleware(format_exc, app)
    return wrap


def _configure_logging():
    logging.basicConfig(level=logging.INFO, filename='/tmp/cgi_test.log',
                        format='%(asctime)s %(levelname)s: %(message)s')
    log.debug('logging configured')


# ISSUE: ambient
_configure_logging()
application = build_app()
