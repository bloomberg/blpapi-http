SRCS_TS :=
SRCS_JS :=
SRCS_TEST_TS :=
SRCS_TEST_JS :=

TEST_DIR = test

SRCS_TS += index.ts
SRCS_TS += $(shell find lib -type f -name '*.ts')

SRCS_TEST_TS += $(wildcard $(TEST_DIR)/*.ts)

SRCS_JS += $(patsubst %.ts,%.js,$(SRCS_TS))
SRCS_TEST_JS += $(patsubst %.ts,%.js,$(SRCS_TEST_TS))

BIN_PREFIX := $(shell npm bin)

TSC_BIN := $(addprefix $(BIN_PREFIX)/,tsc)
TSC_COMMON := --module commonjs --target ES5 --sourceMap --noImplicitAny --noEmitOnError
TSC := $(TSC_BIN) $(TSC_COMMON)

TSLINT_RULES_DIR := tslint-rules
TSLINT := $(addprefix $(BIN_PREFIX)/,tslint) -r $(TSLINT_RULES_DIR)
TSLINT_CONFIG := tslint.json
TSLINT_TARGET := .tslint.d
TSLINT_TEST_TARGET := $(addprefix $(TEST_DIR)/,.tslint.d)

MOCHA_BIN := $(addprefix $(BIN_PREFIX)/,mocha)
MOCHA_COMMON := --reporter spec
MOCHA := $(MOCHA_BIN) $(MOCHA_COMMON)

RM ?= rm -f
TOUCH ?= touch

.PHONY: all build check dependencies tslint test test-mocha clean

all: dependencies build tslint

check: all test

dependencies:
	@npm install

lint: tslint

test: test-mocha

build: $(SRCS_JS)

build-test: $(SRCS_TEST_JS)

build-rules:
	@$(MAKE) -s -C $(TSLINT_RULES_DIR)

clean-rules:
	@$(MAKE) -s -C $(TSLINT_RULES_DIR) clean

tslint: build-rules $(TSLINT_TARGET)

tslint-test: build-rules $(TSLINT_TEST_TARGET)

test-mocha: build build-test tslint-test
	@$(MOCHA)

clean: clean-rules
	@$(RM) $(SRCS_JS) $(patsubst %.js,%.js.map,$(SRCS_JS))
	@$(RM) $(SRCS_TEST_JS) $(patsubst %.js,%.js.map,$(SRCS_TEST_JS))
	@$(RM) $(TSC_TARGET) $(TSLINT_TARGET) $(TSLINT_TEST_TARGET)

$(TSLINT_TARGET): $(SRCS_TS) $(TSLINT_CONFIG)
	@$(RM) $(TSLINT_TARGET)
	@$(TSLINT) $(foreach file,$(SRCS_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TARGET)

$(TSLINT_TEST_TARGET): $(SRCS_TEST_TS) $(TSLINT_CONFIG)
	@$(RM) $(TSLINT_TEST_TARGET)
	@$(TSLINT) $(foreach file,$(SRCS_TEST_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TEST_TARGET)

%.js: %.ts
	@$(TSC) $<
