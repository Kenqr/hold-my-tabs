.PHONY: lint

lint:
	web-ext lint --source-dir=src --ignore-files="lib/**/*"
	npx eslint .
