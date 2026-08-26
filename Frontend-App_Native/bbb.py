import re

s = "'apple, 'Application', 'apply', 'banana', 'apple'"

# TODO: print the list of words containing 'pt'
def findword(n):
    word = n.split()
    ptn = r'\b\w*app\w*\b'
    return re.findall(ptn,n)
print(findword(s))