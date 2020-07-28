import math

# class Vector():
#     def add(self, vec: Vector) -> Vector:
#         pass

#     def mul(self, vec: Vector) -> Vector:
#         pass

#     def length(self) -> float:
#         pass

#     def normalize(self) -> Vector:
#         pass

#     def tuple(self) -> tuple:
#         pass

class Vec2():
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f'Vec2({self.x}, {self.y})'
    
    def __str__(self):
        return f'Vec2({self.x}, {self.y})'

    def add(self, x, y):
        return Vec2(self.x + x, self.y + y)

    def mul(self, x, y):
        return Vec2(self.x * x, self.y * y)

    def length(self) -> float:
        return math.sqrt(self.x ** 2 + self.y ** 2)

    def normalize(self):
        l = self.length()
        return Vec2(self.x / l, self.y / l)

    def normal(self):
        return self.rotate(-90).normalize()

    def rotate(self, deg):
        t = math.radians(deg)
        st = round(math.sin(t), 6)
        ct = round(math.cos(t), 6)

        dx = self.x * ct - self.y * st
        dy = self.x * st + self.y * ct

        return Vec2(dx, dy)

    def invert(self):
        return Vec2(-self.x, -self.y)

    def tuple(self) -> tuple:
        return (self.x, self.y)

    def string(self) -> str:
        return f'Vec2({self.x}, {self.y})'

    @staticmethod
    def getDirectionFromPoints(x1, y1, x2, y2):
        return Vec2(x2 - x1, y2 - y1)

class Vec3():
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

    def add(self, x, y, z):
        return Vec3(self.x + x, self.y + y, self.z + z)

    def mul(self, x, y, z):
        return Vec3(self.x * x, self.y * y, self.z + z)

    def length(self) -> float:
        return math.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def normalize(self):
        l = self.length()
        return Vec3(self.x / l, self.y / l, self.z / l)

    def tuple(self) -> tuple:
        return (self.x, self.y, self.z)

    def string(self) -> str:
        return f'Vec3({self.x}, {self.y}, {self.z})'