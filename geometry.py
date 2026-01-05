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

    def dot(self, other):
        return self.x * other.x + self.y * other.y

    def length(self) -> float:
        return math.sqrt(self.x ** 2 + self.y ** 2)

    def normalize(self):
        l = self.length()
        return Vec2(self.x / l, self.y / l)

    def normal(self):
        return self.rotate(-90).normalize()

    def perp(self):
        return Vec2(-self.y, self.x)

    def rotate(self, deg):
        t = math.radians(deg)
        st = round(math.sin(t), 6)
        ct = round(math.cos(t), 6)

        dx = self.x * ct - self.y * st
        dy = self.x * st + self.y * ct

        return Vec2(dx, dy)

    def invert(self):
        return Vec2(-self.x, -self.y)

    def angleDeg(self):
        return math.degrees(math.atan2(self.y, self.x))

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

    def sub(self, x, y, z):
        return Vec3(self.x - x, self.y - y, self.z - z)

    def mul(self, x, y, z):
        return Vec3(self.x * x, self.y * y, self.z + z)

    def dot(self, other):
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other):
        return Vec3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )

    def length(self) -> float:
        return math.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)

    def normalize(self):
        l = self.length()
        return Vec3(self.x / l, self.y / l, self.z / l)

    def tuple(self) -> tuple:
        return (self.x, self.y, self.z)

    def string(self) -> str:
        return f'Vec3({self.x}, {self.y}, {self.z})'


def plane_from_points(p1: tuple, p2: tuple, p3: tuple) -> tuple:
    """Return normalized plane (nx, ny, nz, d) built from three points."""

    a = Vec3(*p1)
    b = Vec3(*p2)
    c = Vec3(*p3)

    ab = b.sub(a.x, a.y, a.z)
    ac = c.sub(a.x, a.y, a.z)
    normal = ab.cross(ac)
    length = normal.length()
    if length == 0:
        raise ValueError("Cannot build plane from collinear points")

    n = normal.normalize()
    d = -n.dot(a)
    return (n.x, n.y, n.z, d)