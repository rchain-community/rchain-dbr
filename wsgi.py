#!/usr/bin/python3

from wsgiref.util import shift_path_info
import logging

import social_coding_sync as socsync

log = logging.getLogger(__name__)

PLAIN = [('Content-Type', 'text/plain')]


def build_app():
    from pathlib import Path
    from traceback import format_exc  # ISSUE: ambient
    from urllib.request import build_opener

    from sqlalchemy import create_engine

    _configure_logging()
    app = socsync.WSGI_App(create_engine,
                           build_opener,
                           config_path=Path('conf.ini'))
    wrap = error_middleware(format_exc, app)
    return wrap


def error_middleware(format_exc, app):
    def err_app(env, start_response):
        shift_path_info(env)  # strip /aux
        try:
            return app(env, start_response)
        except:  # noqa
            start_response('500 internal error', PLAIN)
            return [format_exc().encode('utf-8')]

    return err_app


def _configure_logging():
    logging.basicConfig(level=logging.INFO, filename='/tmp/wsgi.log',
                        format='%(asctime)s %(levelname)s: %(message)s')
    log.debug('logging configured')


# ISSUE: ambient
application = build_app()
