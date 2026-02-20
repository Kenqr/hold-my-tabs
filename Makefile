.PHONY: build run lint

build:
	web-ext build --source-dir=src --artifacts-dir=dist

run:
	web-ext run --source-dir=src

lint:
	web-ext lint --source-dir=src --ignore-files="lib/**/*"
	npx eslint .
