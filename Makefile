export COPYFILE_DISABLE=1

.PHONY: deploy build initialize pump setup mopMint

setup0:
	agave-install init 1.18.17

setup1:
	avm use 0.29.0

setup: setup0 setup1

build0: setup
	anchor build

deploy0: airdrop generate
	anchor deploy

deploy: 
	anchor deploy

build:
	anchor build

initialize: 
	anchor run initialize

pump:
	anchor run pump

vanityPump:
	anchor run vanityPump

buy:
	anchor run buy

sell:
	anchor run sell

graduate:
	anchor run graduate

updateConfig:
	anchor run updateConfig

acceptOwnership:
	anchor run acceptOwnership

transferOwnership:
	anchor run transferOwnership

integrate: airdrop deploy mopMint initialize pump buy graduate


######################localnet####################
local_validator:
	make -f Makefile.local local_validator

airdrop:
	make -f Makefile.local airdrop

generate:
	make -f Makefile.local generate

mopMint:
	bun run tests/setup-mop.ts

view:
	bun run tests/view.ts 

deploy-hooks:
	anchor deploy -p hooks

deploy-pump:
	anchor deploy -p pump

start: airdrop deploy-hooks deploy-pump mopMint initialize pump buy 