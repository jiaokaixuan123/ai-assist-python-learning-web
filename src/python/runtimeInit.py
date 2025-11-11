string = "你好"
int =1 
print(string)
def add(a, b):
    return a + b
print(add(3, 5))

# 列表
my_list = [1, 2, 3, 4, 5]
# 字典
my_dict = {'name': 'Alice', 'age': 20}
# 类
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

p = Person("Bob", 25)
print(p.name, p.age)