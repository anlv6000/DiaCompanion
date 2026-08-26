import re

def extract_capitalized_words(headline):

    pattern = r'\b\w*app\w*+[A-Z][a-zA-Z]*\b'
 
    words = re.findall(pattern, headline)

    return words

input_text = "'apple', 'Application', 'apply', 'banana', 'apple'"
print(f"Output: {extract_capitalized_words(input_text)}") 
