SRCS_TS =
SRCS_JS_FROM_TS =

SRCS_TS += index.ts
SRCS_TS += $(shell find lib -type f -name '*.ts')

SRCS_JS_FROM_TS += $(patsubst %.ts,%.js,$(SRCS_TS))

BIN_PREFIX := $(shell npm bin)
TSC := $(addprefix $(BIN_PREFIX)/,tsc)
TSC_COMMON = --module commonjs --target ES5 --sourceMap --noImplicitAny --noEmitOnError
TS_TO_JS = $(TSC) $(TSC_COMMON)

TSLINT := $(addprefix $(BIN_PREFIX)/,tslint)
TSLINT_CONFIG := tslint.json
TSLINT_TARGET = .tslint.d

RM ?= rm -f
TOUCH ?= touch

.PHONY: all check typescript tslint clean

all: typescript tslint

check: tslint typescript

typescript: $(SRCS_JS_FROM_TS)

tslint: $(TSLINT_TARGET)

clean:
	$(RM) $(SRCS_JS_FROM_TS) $(patsubst %.js,%.js.map,$(SRCS_JS_FROM_TS))
	$(RM) $(TSC_TARGET) $(TSLINT_TARGET)

$(TSLINT_TARGET): $(SRCS_TS) $(TSLINT_CONFIG)
	@$(RM) $(TSLINT_TARGET)
	$(TSLINT) $(foreach file,$(SRCS_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TARGET)

$(SRCS_JS_FROM_TS): %.js: %.ts
	$(TS_TO_JS) $<
