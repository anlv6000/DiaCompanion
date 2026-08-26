from collections import Counter
text1 = "I love natural language processing"
text2 = "I love language modls"
def similarity(n,m):
    w =Counter(n.lower().split())
    w2 = Counter(m.lower().split())
    inter = w & w2
    intersec = sum(inter.values())
    uni = w | w2
    unio =sum(uni.values())
    return intersec / unio
similar = similarity(text1, text2)
print(f"{similar}")
