FROM webrecorder/pywb

WORKDIR /build
ADD requirements.txt /build/

USER root
RUN pip install -r requirements.txt

USER archivist

VOLUME /data/

# Expose as VOLUMEs for nginx access
VOLUME /usr/local/lib/python3.5/site-packages/pywb/
VOLUME /code/


WORKDIR /code/

