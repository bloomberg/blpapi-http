RM ?= rm -f
BIN_PREFIX := $(shell npm bin)
ROOT_PREFIX := $(shell npm root)

TSC_COMMON := --module commonjs --target ES5 --noImplicitAny --noEmitOnError
TSLINT_D := $(ROOT_PREFIX)/tslint/lib/tslint.d.ts
TSC := $(BIN_PREFIX)/tsc $(TSC_COMMON) $(TSLINT_D)

TSLINT_RULES_TS += $(wildcard *.ts)
TSLINT_RULES_JS += $(patsubst %.ts,%.js,$(TSLINT_RULES_TS))

.PHONY: all clean

all: build

build: $(TSLINT_RULES_JS)

clean:
	@$(RM) $(TSLINT_RULES_JS)

%.js: %.ts
	@$(TSC) $<
