.PHONY: run lint

run:
	web-ext run --source-dir=src

lint:
	web-ext lint --source-dir=src --ignore-files="lib/**/*"
	npx eslint .
