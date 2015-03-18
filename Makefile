# zero-out variable to be appended
SRCS_TS :=
SRCS_JS :=
SRCS_TEST_TS :=
SRCS_TEST_JS :=
SRCS_TSLINT_RULES_TS :=
SRCS_TSLINT_RULES_JS :=
SRCS_SHELL :=

# known directories within the project
TEST_DIR := test
TSLINT_RULES_DIR := tslint-rules
SCRIPTS_DIR = scripts

# glob all source TypeScript files
SRCS_TS += index.ts
SRCS_TS += $(shell find lib -type f -name '*.ts')

SRCS_TEST_TS += $(shell find $(TEST_DIR) -type f -name '*.ts')

SRCS_TSLINT_RULES_TS += $(wildcard $(TSLINT_RULES_DIR)/*.ts)

# translate .ts => .js for targets
SRCS_JS += $(patsubst %.ts,%.js,$(SRCS_TS))
SRCS_TEST_JS += $(patsubst %.ts,%.js,$(SRCS_TEST_TS))
SRCS_TSLINT_RULES_JS += $(patsubst %.ts,%.js,$(SRCS_TSLINT_RULES_TS))

# glob scripts
SRCS_SHELL += $(shell find $(SCRIPTS_DIR) -type f -name '*.sh')

# setup variables for program execution
BIN_PREFIX := $(shell npm bin)
ROOT_PREFIX := $(shell npm root)

TSC_BIN := $(addprefix $(BIN_PREFIX)/,tsc)
TSC_FLAGS := --module commonjs --target ES5 --noImplicitAny --noEmitOnError
TSC := $(TSC_BIN) $(TSC_FLAGS)

TSLINT := $(addprefix $(BIN_PREFIX)/,tslint)
TSLINT_CONFIG := tslint.json
TSLINT_TARGET := .tslint.d
TSLINT_D := $(ROOT_PREFIX)/tslint/lib/tslint.d.ts
TSLINT_TEST_TARGET := $(addprefix $(TEST_DIR)/,.tslint.d)

SHELLCHECK := shellcheck
SHELLCHECK_FAKE_TARGET := $(addprefix $(SCRIPTS_DIR)/,.shellcheck.d)

MOCHA_BIN := $(addprefix $(BIN_PREFIX)/,mocha)
MOCHA_FLAGS := --reporter spec
MOCHA := $(MOCHA_BIN) $(MOCHA_FLAGS)

RM ?= rm -f
TOUCH ?= touch

# top-level targets
.PHONY: all build check dependencies shellcheck tslint test test-mocha clean

all: dependencies build tslint

check: all lint test

dependencies:
	@npm install

lint: tslint tslint-test shellcheck

test: test-mocha

build: $(SRCS_JS)

build-test: $(SRCS_TEST_JS)

tslint: $(TSLINT_TARGET)

tslint-test: $(TSLINT_TEST_TARGET)

shellcheck: $(SHELLCHECK_FAKE_TARGET)

test-mocha: build build-test tslint-test
	@$(MOCHA)

# rules
clean:
	@$(RM) $(SRCS_JS) $(patsubst %.js,%.js.map,$(SRCS_JS))
	@$(RM) $(SRCS_TEST_JS) $(patsubst %.js,%.js.map,$(SRCS_TEST_JS))
	@$(RM) $(TSC_TARGET) $(TSLINT_TARGET) $(TSLINT_TEST_TARGET)
	@$(RM) $(SRCS_TSLINT_RULES_JS)


$(SHELLCHECK_FAKE_TARGET): $(SRCS_SHELL)
	@$(RM) $(SHELLCHECK_FAKE_TARGET)
	@$(SHELLCHECK) $(SRCS_SHELL)
	@$(TOUCH) $(SHELLCHECK_FAKE_TARGET)

$(TSLINT_TARGET): $(SRCS_TS) $(TSLINT_CONFIG) $(SRCS_TSLINT_RULES_JS)
	@$(RM) $(TSLINT_TARGET)
	@$(TSLINT) -r $(TSLINT_RULES_DIR) $(foreach file,$(SRCS_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TARGET)

$(TSLINT_TEST_TARGET): $(SRCS_TEST_TS) $(TSLINT_CONFIG) $(SRCS_TSLINT_RULES_JS)
	@$(RM) $(TSLINT_TEST_TARGET)
	@$(TSLINT) -r $(TSLINT_RULES_DIR) $(foreach file,$(SRCS_TEST_TS),-f $(file))
	@$(TOUCH) $(TSLINT_TEST_TARGET)

$(SRCS_TSLINT_RULES_JS): $(SRCS_TSLINT_RULES_TS)
	@$(TSC) $(TSLINT_D) $(SRCS_TSLINT_RULES_TS)

$(SRCS_TEST_JS): $(SRCS_TEST_TS)
	@$(TSC) --sourceMap $(SRCS_TEST_TS)

$(SRCS_JS): $(SRCS_TS)
	@$(TSC) --sourceMap $(SRCS_TS)
