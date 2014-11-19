SRCS_TS =
SRCS_JS_FROM_TS =

TOP_LEVEL_TS_FILE = index.ts

SRCS_TS += $(wildcard *.ts)
SRCS_TS += $(wildcard tslib/*.ts)

SRCS_JS_FROM_TS += $(patsubst %.ts,%.js,$(SRCS_TS))

TSC = tsc
TSC_COMMON = --module commonjs --target ES5 --sourceMap --noImplicitAny
TS_TO_JS = $(TSC) $(TSC_COMMON)

RM ?= rm -f

.PHONY: all typescript clean

all: typescript

typescript: $(SRCS_JS_FROM_TS)

clean:
	$(RM) $(SRCS_JS_FROM_TS) $(patsubst %.js,%.js.map,$(SRCS_JS_FROM_TS))

$(SRCS_JS_FROM_TS): $(SRCS_TS)
	$(QUIET_TSC) $(TS_TO_JS) $(TOP_LEVEL_TS_FILE)

