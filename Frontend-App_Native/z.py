import re

paragraph = "Python is popular. NLP uses Python! Is Java useful?"

# TODO: print sentences sorted from shortest to longest (by word count)
def sortpar(n):
    sentences = [s.strip() for s in re.split(r'(?<=\.)', n) if s.strip()]
    sorte = sorted(sentences, key = lambda s: len(s.split()))
    return sorte
print(sortpar(paragraph))