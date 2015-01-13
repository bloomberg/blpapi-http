SRCS_TS =
SRCS_JS_FROM_TS =

TOP_LEVEL_TS_FILE = index.ts

SRCS_TS += index.ts
SRCS_TS += $(wildcard lib/*.ts)

SRCS_JS_FROM_TS += $(patsubst %.ts,%.js,$(SRCS_TS))

TSC = tsc
TSC_COMMON = --module commonjs --target ES5 --sourceMap --noImplicitAny
TS_TO_JS = $(TSC) $(TSC_COMMON)
TSC_TARGET = .tsc.d

TSLINT = tslint
TSLINT_TARGET = .tslint.d

RM ?= rm -f
TOUCH ?= touch

.PHONY: all typescript tslint clean

all: typescript tslint

typescript: $(SRCS_JS_FROM_TS) $(TSC_TARGET)

tslint: $(TSLINT_TARGET)

clean:
	$(RM) $(SRCS_JS_FROM_TS) $(patsubst %.js,%.js.map,$(SRCS_JS_FROM_TS))
	$(RM) $(TSC_TARGET) $(TSLINT_TARGET)

$(TSLINT_TARGET): $(TSC_TARGET)
	@$(RM) $(TSLINT_TARGET)
	$(TSLINT) $(foreach file,$(SRCS_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TARGET)

$(TSC_TARGET) $(SRCS_JS_FROM_TS): $(SRCS_TS)
	@$(RM) $(TSC_TARGET)
	$(QUIET_TSC) $(TS_TO_JS) $(TOP_LEVEL_TS_FILE)
	@$(TOUCH) $(TSC_TARGET)

