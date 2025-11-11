# 在这里编写 Python 代码
print("Hello, Monaco AI!")

for i in range(5):
    print(f"Count: {i}")

def addtwo(a,b):
    return a+b

my_list = [1,2,3,4,5]
my_dict = {'name': 'Alice', 'age': 20}

print(addtwo(2,3))

class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

p = Person("Bob", 25)
print(p.name, p.age)